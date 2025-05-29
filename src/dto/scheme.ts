interface Attribute {
    name: string
    type: number
    constraints: number[]
}

interface TableDependency {
    determinants: string[]
    dependants: string[]
}

interface Table {
    name: string
    attributes: Attribute[]
    dependencies: TableDependency[]
}

interface RelationshipDestination {
    tableName: string
    attributeNames: string[]
}

interface Relationship {
    from: RelationshipDestination
    to: RelationshipDestination
}

interface Scheme {
    tables: Table[]
    relationships: Relationship[]
}

export type {
    Attribute,
    TableDependency,
    Table,
    RelationshipDestination,
    Relationship,
    Scheme,
}