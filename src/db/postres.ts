import { Pool } from "pg"

declare global {
    // allow global `pool` across module reloads in dev
    // eslint-disable-next-line no-var
    var __pgPool: Pool | null
}

const pool: Pool = global.__pgPool ??
    new Pool({
        host:     process.env.PGHOST,
        port:     Number(process.env.PGPORT),
        database: process.env.PGDATABASE,
        user:     process.env.PGUSER,
        password: process.env.PGPASSWORD,
    })

if (process.env.NODE_ENV !== "production") global.__pgPool = pool

export default pool