const mysql = require('mysql2/promise');

let pool;

async function ensureDatabaseExists(config, database) {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createPoolWithRetry(config, attempts, delayMs) {
    let lastError;

    const target = `${config.host}:${config.port}`;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await ensureDatabaseExists(config, config.database);

            const candidatePool = mysql.createPool(config);
            try {
                await candidatePool.query('SELECT 1');
                return candidatePool;
            } catch (error) {
                await candidatePool.end();
                throw error;
            }
        } catch (error) {
            lastError = error;
            const waitMs = Math.max(delayMs, 0) * attempt;
            console.warn(
                `MariaDB connection attempt ${attempt} to ${target} failed (${error.code || error.message}).` +
                    (attempt < attempts
                        ? ` Retrying in ${waitMs}ms...`
                        : ' No more retries remaining.')
            );

            if (attempt < attempts && waitMs > 0) {
                await sleep(waitMs);
            }
        }
    }

    throw lastError;
}

async function applyMigrations(activePool) {
    // ───────────── users 테이블 ─────────────
    await activePool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            real_name VARCHAR(255) NOT NULL,
            student_id VARCHAR(50) NOT NULL,
            nickname VARCHAR(255) UNIQUE NOT NULL,
            reputation_score DECIMAL(5,2) DEFAULT 5.00,
            reputation_count INT DEFAULT 0,
            is_admin TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
    `);

    // ───────────── reputation_reviews 테이블 ─────────────
    await activePool.query(`
        CREATE TABLE IF NOT EXISTS reputation_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reviewer_id INT NOT NULL,
            target_id INT NOT NULL,
            auction_id VARCHAR(255) NOT NULL,
            score DECIMAL(3,1) NOT NULL,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_review (reviewer_id, target_id, auction_id),
            FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
            )
    `);

    // auction_id 컬럼 누락 시 추가
    await activePool.query(`
        ALTER TABLE reputation_reviews
            ADD COLUMN IF NOT EXISTS auction_id VARCHAR(255) NOT NULL DEFAULT '' AFTER target_id
    `);

    // 빈 auction_id를 legacy로 채움
    await activePool.query(`
        UPDATE reputation_reviews
        SET auction_id = CONCAT('legacy-', id)
        WHERE auction_id = ''
    `);

    // score 컬럼 형식 보정
    await activePool.query(`
        ALTER TABLE reputation_reviews
            MODIFY COLUMN score DECIMAL(3,1) NOT NULL
    `);

    // ⚠️ unique_review 인덱스는 이미 존재하므로 DROP 시도 제거
    // 대신 중복 추가를 방지하며 존재하지 않을 때만 생성
    try {
        await activePool.query(`
            ALTER TABLE reputation_reviews
                ADD UNIQUE KEY IF NOT EXISTS unique_review (reviewer_id, target_id, auction_id)
        `);
    } catch (error) {
        if (error.code !== 'ER_DUP_KEYNAME') {
            throw error;
        }
    }

    // ───────────── bid_logs 테이블 ─────────────
    await activePool.query(`
        CREATE TABLE IF NOT EXISTS bid_logs (
                                                id INT AUTO_INCREMENT PRIMARY KEY,
                                                auction_id VARCHAR(255) NOT NULL,
            bidder_id INT NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE
            )
    `);
}

async function ensureAdminAccount(activePool) {
    const [rows] = await activePool.query('SELECT id FROM users WHERE email = ?', [process.env.ADMIN_EMAIL || 'admin@example.com']);
    if (!rows.length) {
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin!234', 10);
        const nickname = `관리자-${Math.random().toString(36).substring(2, 8)}`;
        await activePool.query(
            `INSERT INTO users (email, password_hash, real_name, student_id, nickname, is_admin)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [process.env.ADMIN_EMAIL || 'admin@example.com', passwordHash, 'Super Admin', '202010832', nickname]
        );
    }
}

async function initMaria() {
    if (pool) {
        return pool;
    }

    const attempts = Math.max(parseInt(process.env.MARIADB_RETRY_ATTEMPTS, 10) || 5, 1);
    const delayMs = Math.max(parseInt(process.env.MARIADB_RETRY_DELAY_MS, 10) || 2000, 0);

    const config = {
        host: process.env.MARIADB_HOST || 'localhost',
        user: process.env.MARIADB_USER || 'root',
        password: process.env.MARIADB_PASSWORD || '3203',
        database: process.env.MARIADB_DATABASE || '202010832',
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true
    };

    pool = await createPoolWithRetry(config, attempts, delayMs);

    console.log(`Connected to MariaDB at ${config.host}:${config.port} (database: ${config.database}).`);

    await applyMigrations(pool);
    await ensureAdminAccount(pool);

    return pool;
}

function getMariaPool() {
    if (!pool) {
        throw new Error('MariaDB has not been initialized. Call initMaria() first.');
    }
    return pool;
}

module.exports = { initMaria, getMariaPool };
