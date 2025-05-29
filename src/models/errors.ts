const DuplicateEntities = new Error("duplicate entities in scheme")
const DuplicateAttributes = new Error("duplicate attributes in an entity")
const UnknownAttributeType = new Error("unknown attribute type")
const UnknownConstraint = new Error("unknown attribute constraint")
const InvalidRelationshipDestination = new Error("entity or attribute does not exist")

const NoScheme = new Error("no scheme present")

export {
    DuplicateEntities,
    DuplicateAttributes,
    UnknownAttributeType,
    UnknownConstraint,
    InvalidRelationshipDestination,
    NoScheme
}