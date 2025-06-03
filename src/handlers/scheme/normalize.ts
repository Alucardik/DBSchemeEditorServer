import { Scheme } from "../../models/scheme.js"
import type { Scheme as SchemeDTO } from "../../dto/scheme.js"
import { HTTPStatuses } from "../../utils/http.js"
import { Normalizer } from "../../relational/normalization.js"
import { Request, Response } from "express"

export default async function handler(req: Request, res: Response) {
    let rawScheme = req.body as SchemeDTO
    if (!rawScheme?.tables || !rawScheme?.relationships) {
        res.status(HTTPStatuses.BAD_REQUEST).json({message: "empty scheme"})
        return
    }

    let nf = 3
    if (req.query["nf"] === "2") {
        nf = 2
    }

    const scheme = new Scheme(rawScheme)
    const normalizer = new Normalizer(scheme)

    const [newScheme, violations] = nf === 2 ? normalizer.SecondNormalForm() : normalizer.ThirdNormalForm()
    if (violations.length > 0 || !newScheme) {
        res.status(HTTPStatuses.UNPROCESSABLE_ENTITY).json({violations})
        return
    }

    res.status(HTTPStatuses.OK).json({
        scheme: newScheme.ToDTO(),
    })
}