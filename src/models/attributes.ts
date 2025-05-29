import type { Attribute as AttributeDTO } from "@/libs/dto/scheme"

enum AttributeType {
    Unknown = -1,
    Integer,
    Float,
    String,
    Boolean,
}

enum AttributeConstraint {
    NotNullable,
    PrimaryKey,
    ForeignKey,
}

const KeyTypeConstraints = new Set([AttributeConstraint.PrimaryKey, AttributeConstraint.ForeignKey]) as ReadonlySet<AttributeConstraint>

class Attribute {
    readonly isPrimaryKey: boolean = false
    name: string = ""
    type: AttributeType = AttributeType.Unknown
    constraints: Set<AttributeConstraint> = new Set()

    constructor(rawObj?: AttributeDTO) {
        if (!rawObj) {
            return
        }

        this.name = rawObj.name
        this.type = rawObj.type
        this.constraints = new Set(rawObj.constraints)
        this.isPrimaryKey = this.constraints.has(AttributeConstraint.PrimaryKey)
    }

    ToDTO(this: Attribute): AttributeDTO {
        return {
            name: this.name,
            type: this.type,
            constraints: Array.from(this.constraints),
        }
    }
}

export {
    AttributeType,
    AttributeConstraint,
    Attribute,
    KeyTypeConstraints,
}