import { getAppPort, setupCORS } from "@/utils/configuration"
import express from "express"
import path from "path"
import cookieParser from "cookie-parser"
import logger from "morgan"
import indexRouter from "../routes/index"
import http from "http"
import debug from "debug"


function initApp(): express.Application {
    const app = express()

    app.use(setupCORS())
    app.use(logger("dev"))
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(cookieParser())
    app.use(express.static(path.join(__dirname, "public")))

    app.use("/api", indexRouter)

    return app
}

function onServerError(error: NodeJS.ErrnoException) {
    if (error.syscall !== "listen") {
        throw error
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            console.error("app port requires elevated privileges")
            process.exit(1)
            break
        case "EADDRINUSE":
            console.error("app is already in use")
            process.exit(1)
            break
        default:
            throw error
    }
}

function main(): void {
    const app = initApp()
    const port = getAppPort()
    const server = http.createServer(app)

    app.set("port", port)
    server.listen(port)
    server.on("error", onServerError)
    server.on("listening", () => console.log(`Listening on ${port}`))

    debug("dbschemeeditorserver:server")
}

main()
