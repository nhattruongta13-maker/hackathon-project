import {pool} from './db.ts'

const create = async () => {
    pool.query(`CREATE TABLE users(
        "userId" SERIAL PRIMARY KEY NOT NULL,
        "userName" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW())`)
}

create()