import express from "express"
import normalizeHandler from "../handlers/scheme/normalize.js"
import applyHandler from "../handlers/scheme/apply.js"
import generateSQLHandler from "../handlers/scheme/generate_sql.js"

const router = express.Router()

router.post("/normalize", normalizeHandler)
router.post("/apply", applyHandler)
router.post("/generate/sql", generateSQLHandler)

export default router