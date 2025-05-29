import { Attribute } from "@/models/attributes"
import type * as dto from "@/dto/scheme"


class TableDependency {
    determinants: string[] = []
    dependants: string[] = []

    constructor(rawObj?: dto.TableDependency) {
        if (rawObj) {
            this.determinants = rawObj.determinants
            this.dependants = rawObj.dependants
        }
    }

    ToDTO(this: TableDependency): dto.TableDependency {
        return {
            determinants: this.determinants,
            dependants: this.dependants,
        }
    }
}

class Table {
    readonly primaryKey: string[] = []
    name: string = ""
    attributes: Attribute[] = []
    dependencies: TableDependency[] = []

    constructor(rawObj?: dto.Table) {
        if (!rawObj) {
            return
        }

        this.name = rawObj.name
        this.attributes = rawObj.attributes.map(attr => new Attribute(attr))
        this.dependencies = rawObj.dependencies.map(dependency => new TableDependency(dependency))
        this.primaryKey = this.attributes.filter(attr => attr.isPrimaryKey).map(attr => attr.name)
    }

    ToDTO(this: Table): dto.Table {
        return {
            name: this.name,
            attributes: this.attributes.map(attr => attr.ToDTO()),
            dependencies: this.dependencies.map(dependency => dependency.ToDTO()),
        }
    }
}

class RelationshipDestination {
    tableName: string = ""
    attributeNames: string[] = []

    constructor()
    constructor(rawObj?: dto.RelationshipDestination)
    constructor(tableName: string, attributeNames: string[])
    constructor(tableName?: string | dto.RelationshipDestination, attributeNames?: string[]) {
        if (!tableName) {
            return
        }

        if (typeof tableName === "string") {
            this.tableName = tableName

            if (attributeNames) {
                this.attributeNames = attributeNames
            }

            return
        }

        const dtoObj = tableName as dto.RelationshipDestination
        this.tableName = dtoObj.tableName
        this.attributeNames = dtoObj.attributeNames
    }

    ToDTO(this: RelationshipDestination): dto.RelationshipDestination {
        return {
            tableName: this.tableName,
            attributeNames: this.attributeNames,
        }
    }
}

class Relationship {
    from: RelationshipDestination = new RelationshipDestination()
    to: RelationshipDestination = new RelationshipDestination()

    constructor()
    constructor(rawObj?: dto.Relationship)
    constructor(from: RelationshipDestination, to: RelationshipDestination)
    constructor(from?: RelationshipDestination | dto.Relationship, to?: RelationshipDestination) {
        if (!from) {
            return
        }

        if (from instanceof RelationshipDestination) {
            this.from = from

            if (to) {
                this.to = to
            }

            return
        }

        this.from = new RelationshipDestination((from as dto.Relationship).from)

    }

    ToDTO(this: Relationship): dto.Relationship {
        return {
            from: this.from.ToDTO(),
            to: this.to.ToDTO(),
        }
    }
}

class Scheme {
    tables: Table[] = []
    relationships: Relationship[] = []

    constructor(rawObj?: dto.Scheme) {
        if (!rawObj) {
            return
        }

        this.tables = rawObj.tables.map(table => new Table(table))
        this.relationships = rawObj.relationships.map(relationship => new Relationship(relationship))
    }

    ToDTO(this: Scheme): dto.Scheme {
        return {
            tables: this.tables.map(table => table.ToDTO()),
            relationships: this.relationships.map(relationship => relationship.ToDTO()),
        }
    }
}

export {
    Scheme,
    TableDependency,
    Table,
    RelationshipDestination,
    Relationship,
}