import type { Scheme as SchemeDTO } from "../../dto/scheme.js"
import { Scheme } from "../../models/scheme.js"
import { HTTPStatuses } from "../../utils/http.js"
import { QueryBuilder } from "../../db/query_builder.js"
import { Request, Response } from "express"


export default async function handler(req: Request, res: Response) {
    let rawScheme = req.body as SchemeDTO

    if (!rawScheme?.tables || !rawScheme?.relationships) {
        res.status(HTTPStatuses.BAD_REQUEST).json({message: "bad request"})
        return
    }

    const scheme = new Scheme(rawScheme)
    const queryBuilder = new QueryBuilder()

    const err = queryBuilder.SetScheme(scheme)
    if (err) {
        console.error(err)
        res.status(HTTPStatuses.BAD_REQUEST).json({message: err.message})
        return
    }

    const [sql, buildErr] = queryBuilder.Build()
    if (buildErr) {
        res.status(HTTPStatuses.BAD_REQUEST).json({message: buildErr.message})
        return
    }


    res.status(HTTPStatuses.OK).json({ sql })
}