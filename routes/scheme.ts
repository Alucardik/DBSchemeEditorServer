import express from "express"
import normalizeHandler from "../handlers/scheme/normalize"
import applyHandler from "../handlers/scheme/apply"
import generateSQLHandler from "../handlers/scheme/generate_sql"

const router = express.Router()

router.post("/normalize", normalizeHandler)
router.post("/apply", applyHandler)
router.post("/generate/sql", generateSQLHandler)

export default router