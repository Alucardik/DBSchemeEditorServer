import express from "express"
import schemeRouter from "./scheme"

const router = express.Router()
router.use("/scheme", schemeRouter)

export default router
