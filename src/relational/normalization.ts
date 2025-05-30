import { Attribute, AttributeConstraint, KeyTypeConstraints } from "../models/attributes.js"
import { Relationship, RelationshipDestination, Scheme, Table } from "../models/scheme.js"
import { DependencyMatrix } from "./dependency_matrix.js"
import { Optional } from "../utils/optional.js"

class NormalFormViolation {
    tableName: string = ""
    attributeName: string = ""
    violation: string = ""

    constructor(tableName: string, attributeName: string, violation: string) {
        this.tableName = tableName
        this.attributeName = attributeName
        this.violation = violation
    }
}

export class Normalizer {
    private scheme: Scheme

    constructor(scheme: Scheme) {
        // TODO: use deep copy
        this.scheme = scheme
    }

    CheckFirstNormalForm(this: Normalizer): NormalFormViolation[] {
        // TODO: can use extensive memoization (remember last result for this scheme and reset it in case of scheme change)
        const ret = [] as NormalFormViolation[]
        this.scheme.tables.forEach(entity => {
            if (entity.primaryKey.length === 0) {
                ret.push(new NormalFormViolation(entity.name, "", "no PK present"))
            }

            const entityAttributeSet = new Set(entity.attributes.map(attr => attr.name))
            const unknownAttributes = new Set<string>()

            entity.dependencies.forEach(dependency => {
                dependency.dependants.forEach(dependant => {
                    if (!entityAttributeSet.has(dependant)) {
                        unknownAttributes.add(dependant)
                    }
                })

                dependency.determinants.forEach(determinant => {
                    if (!entityAttributeSet.has(determinant)) {
                        unknownAttributes.add(determinant)
                    }
                })
            })

            ret.push(...unknownAttributes.values().map(attrName => new NormalFormViolation(entity.name, attrName, "unknown attribute")))
        })

        return ret
    }

    SecondNormalForm(this: Normalizer): [Optional<Scheme>, NormalFormViolation[]] {
        const violations = this.CheckFirstNormalForm()
        if (violations.length > 0) {
            return [null, violations]
        }

        const ret = new Scheme()

        // const dependencyMatrices = new Map<string, DependencyMatrix>()
        this.scheme.tables.forEach(entity => {
            const [tables, relationships] = this.TurnTableToNormalForm(entity, new DependencyMatrix(entity.dependencies), 2)
            ret.tables.push(...tables)
            ret.relationships.push(...relationships)
        })

        // FIXME: take existing relationships into account
        // ret.relationships.push(this.scheme.relationships.map...)

        return [ret, []]
    }

    ThirdNormalForm(this: Normalizer): [Optional<Scheme>, NormalFormViolation[]] {
        const violations = this.CheckFirstNormalForm()
        if (violations.length > 0) {
            return [null, violations]
        }

        const ret = new Scheme()

        // const dependencyMatrices = new Map<string, DependencyMatrix>()
        this.scheme.tables.forEach(entity => {
            const [tables, relationships] = this.TurnTableToNormalForm(entity, new DependencyMatrix(entity.dependencies), 3)
            ret.tables.push(...tables)
            ret.relationships.push(...relationships)
        })

        // FIXME: take existing relationships into account
        // ret.relationships.push(this.scheme.relationships.map...)

        return [ret, []]
    }

    private TurnTableToNormalForm(this: Normalizer, table: Table, fdMatrix: DependencyMatrix, normalForm: 2 | 3): [Table[], Relationship[]] {
        const tableRelations = normalForm === 2 ? fdMatrix.ToSecondNormalForm() : fdMatrix.ToThirdNormalForm()

        const tableAttrMap = new Map<string, Attribute>()
        table.attributes.forEach(attribute => {
            tableAttrMap.set(attribute.name, attribute)
        })

        const newRelations = [] as Relationship[]
        const newTables = fdMatrix.GetCanonizedRows().map(((fd, index) => {
            const attributes = [] as Attribute[]

            // TODO: maybe remove copy-paste between rhs / lhs
            for (const pkAttr of fd.lhs.values()) {
                const attr = tableAttrMap.get(pkAttr)
                if (!attr) {
                    continue
                }

                console.log("assigning", attr, "as PK in", table.name + `Part${index + 1}`)

                attributes.push(new Attribute({
                    name: attr.name,
                    type: attr.type,
                    // preserve all constraints except for keys, since they are reassigned
                    constraints: [AttributeConstraint.PrimaryKey, ...attr.constraints.difference(KeyTypeConstraints).values()],
                }))
            }

            for (const attrName of fd.rhs.values()) {
                const attr = tableAttrMap.get(attrName)
                if (!attr) {
                    continue
                }

                attributes.push(new Attribute({
                    name: attr.name,
                    type: attr.type,
                    constraints: [...attr.constraints.difference(KeyTypeConstraints).values()],
                }))
            }

            // new tables should not have any dependencies except from the primary key (but we do not list them directly)
            // TODO: add constructor from classes instead of DTO
            return new Table({
                name: table.name + `Part${index + 1}`,
                // @ts-ignore
                attributes: attributes,
                dependencies: [],
            })
        }))

        for (const [i, relations] of tableRelations.entries()) {
            for (const [fkAttributes, fkTableIndex] of relations) {
                console.log("adding fk relation from", fkAttributes, "to", fkTableIndex)
                console.log("adding from", newTables[i].name, newTables[fkTableIndex].name)

                const from = new RelationshipDestination(
                    newTables[i].name,
                    fkAttributes,
                )
                const to =  new RelationshipDestination(
                    newTables[fkTableIndex].name,
                    fkAttributes,
                )

                newRelations.push(new Relationship(from, to))

                // set foreign key constraints on the table with the superset of lhs (pk)
                fkAttributes.forEach(fkAttr => {
                    const attr = newTables[i].attributes.find(attr => attr.name === fkAttr)
                    if (attr) {
                        attr.constraints.add(AttributeConstraint.ForeignKey)
                    }
                })
            }
        }

        return [newTables, newRelations]
    }
}