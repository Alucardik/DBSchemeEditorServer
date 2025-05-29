import cors from "cors"
import { Handler } from "express"

const DEFAULT_PORT = 3000

function getAppPort(): number {
    const port = parseInt(process.env.PORT || "", 10)

    if (isNaN(port)) {
        return DEFAULT_PORT
    }

    return port >= 0 ? port : DEFAULT_PORT
}

function setupCORS(): Handler {
    return cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl)
            if (!origin) return callback(null, true)

            // Test if origin is localhost on any port
            const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin)
            if (isLocalhost) {
                return callback(null, true)
            }

            // Otherwise reject
            callback(new Error("Not allowed by CORS"))
        },
        credentials: true,           // if you need to send cookies / auth headers
        methods: ["GET","POST","PUT","DELETE","OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
}

export {
    getAppPort,
    setupCORS,
}
