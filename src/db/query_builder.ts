import { Attribute, AttributeConstraint, AttributeType } from "../models/attributes.js"
import { RelationshipDestination, Scheme } from "../models/scheme.js"
import {
    DuplicateAttributes,
    DuplicateEntities,
    InvalidRelationshipDestination,
    NoScheme,
    UnknownAttributeType,
    UnknownConstraint
} from "../models/errors.js"
import { Optional } from "../utils/optional.js"
import format from "pg-format"

export class QueryBuilder {
    private scheme: Optional<Scheme> = null

    ValidateScheme(this: QueryBuilder, scheme: Scheme): Optional<Error> {
        const entityNames = new Set(scheme.tables.map((entity) => entity.name))

        if (entityNames.size !== scheme.tables.length) {
            return DuplicateEntities
        }

        const attributesMap = new Map<string, Set<string>>()

        for (const entity of scheme.tables) {
            const attributeNames = new Set<string>()

            for (const attribute of entity.attributes) {
                if (attribute.type < 0 || attribute.type > AttributeType.Boolean) {
                    return UnknownAttributeType
                }

                for (const constraint of attribute.constraints) {
                    if (constraint < 0 || constraint > AttributeConstraint.ForeignKey) {
                        return UnknownConstraint
                    }
                }

                attributeNames.add(attribute.name)
            }

            if (attributeNames.size !== entity.attributes.length) {
                return DuplicateAttributes
            }

            attributesMap.set(entity.name, attributeNames)
        }

        const verifyDestination = (dest: RelationshipDestination): boolean => {
            const attributes = attributesMap.get(dest.tableName)

            if (!attributes || dest.attributeNames.length === 0) {
                return false
            }

            return dest.attributeNames.every(attrName => attributes.has(attrName))
        }

        for (const relationship of scheme.relationships) {
            if (!verifyDestination(relationship.from) || !verifyDestination(relationship.to)) {
                return InvalidRelationshipDestination
            }
        }

        return null
    }

    SetScheme(this: QueryBuilder, scheme: Scheme): Optional<Error> {
        const err = this.ValidateScheme(scheme)
        if (err !== null) {
            return err
        }

        this.scheme = scheme

        return null
    }

    Build(this: QueryBuilder): [string, Optional<Error>] {
        if (!this.scheme) {
            return ["", NoScheme]
        }

        const queryParts = [] as string[]
        const foreignKeyPairs = [] as [number, number[]][]

        for (const [index, entity] of this.scheme.tables.entries()) {
            const [table, foreignKeyIndexes, err] = this.CreateTableQuery(entity.name, entity.attributes)
            if (err) {
                return ["", err]
            }

            if (foreignKeyIndexes.length > 0) {
                foreignKeyPairs.push([index, foreignKeyIndexes])
            }

            queryParts.push(table)
        }

        for (const relationship of this.scheme.relationships) {
            const firstEntity = this.scheme.tables.find((entity) => entity.name === relationship.from.tableName)
            if (!firstEntity) {
                continue
            }

            // FIXME: support multi-part foreign keys (and use set)
            const firstAttr = firstEntity.attributes.find((attribute) => relationship.from.attributeNames.findIndex(attrName => attrName === attribute.name) !== -1)
            if (!firstAttr) {
                continue
            }

            const secondEntity = this.scheme.tables.find((entity) => entity.name === relationship.to.tableName)
            if (!secondEntity) {
                continue
            }

            const secondAttr = secondEntity.attributes.find((attribute) => relationship.to.attributeNames.findIndex(attrName => attrName === attribute.name) !== -1)
            if (!secondAttr) {
                continue
            }

            try {
                // TODO: check how array substitution works
                const res = format("ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(%I) REFERENCES %I (%I);",
                    relationship.from.tableName,
                    ["fk", relationship.from.tableName, relationship.from.attributeNames, "to", relationship.to.tableName, relationship.to.attributeNames].join("_"),
                    relationship.from.attributeNames,
                    relationship.to.tableName,
                    relationship.to.attributeNames,
                )
                queryParts.push(res)
            } catch (e) {
                return ["", e as Error]
            }
        }

        // maybe add additional foreign key validation
        // for (const [entityIndex, foreignKeyIndexes] of foreignKeyPairs) {
        //     for (const attrIndex of foreignKeyIndexes) {
        //         this.scheme.entities[entityIndex].attributes[attrIndex].
        //     }
        // }

        return [queryParts.join("\n"), null]
    }

    private CreateTableQuery(this: QueryBuilder, tableName: string, attributes: Attribute[]): [string, number[], Optional<Error>] {
        const queryParts = ["CREATE TABLE %I ("] as string[]
        const queryArgs = [tableName]
        const foreignKeyIndexes = [] as number[]

        for (const [index, attribute] of attributes.entries()) {
            let attrQuery = "%I "
            switch (attribute.type) {
                case AttributeType.Integer:
                    attrQuery += "INTEGER"
                    break
                case AttributeType.Float:
                    attrQuery += "FLOAT"
                    break
                case AttributeType.String:
                    attrQuery += "TEXT"
                    break
                case AttributeType.Boolean:
                    attrQuery += "BOOLEAN"
                    break
                default:
                    return ["", [], UnknownAttributeType]
            }

            for (const constraint of new Set(attribute.constraints)) {
                switch (constraint) {
                    case AttributeConstraint.NotNullable:
                        attrQuery += " NOT NULL"
                        break
                    case AttributeConstraint.PrimaryKey:
                        attrQuery += " PRIMARY KEY"
                        break
                    case AttributeConstraint.ForeignKey:
                        foreignKeyIndexes.push(index)
                        break
                }
            }

            if (index !== attributes.length - 1) {
                attrQuery += ","
            }

            queryParts.push(attrQuery)
            queryArgs.push(attribute.name)
        }

        queryParts.push(");")

        try {
            const res = format(queryParts.join("\n"), ...queryArgs)
            return [res, foreignKeyIndexes, null]
        } catch (e) {
            // @ts-ignore
            return ["", foreignKeyIndexes, e]
        }
    }


}