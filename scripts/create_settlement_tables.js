const db = require('../utils/dbconnect');

async function createTables() {
    try {
        console.log('Creating settlement_order_details table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS settlement_order_details (
              id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              brandID               VARCHAR(100)    NOT NULL,
              orderItemID           INT             NOT NULL,
              orderID               INT             NOT NULL,
              productID             VARCHAR(125)    NOT NULL,
              productName           VARCHAR(500)    DEFAULT NULL,
              variationName         VARCHAR(255)    DEFAULT NULL,
              quantity              INT             NOT NULL DEFAULT 1,
              lineTotalAfter        DECIMAL(10,2)   NOT NULL,
              commissionPct         DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
              commissionAmount      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
              brandEarning          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
              settlementMonth       VARCHAR(7)      NOT NULL,
              event                 ENUM(
                'order_placed',
                'order_delivered',
                'return_window_cleared',
                'returned',
                'return_rejected',
                'replacement_original',
                'replacement_item',
                'cancelled',
                'carried_forward',
                'manual_adjustment'
              ) NOT NULL,
              effect                ENUM('credit','debit','hold','neutral') NOT NULL,
              effectAmount          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
              isReplacement         TINYINT(1)      NOT NULL DEFAULT 0,
              wasCarriedForward     TINYINT(1)      NOT NULL DEFAULT 0,
              refundQueryID         VARCHAR(50)     DEFAULT NULL,
              notes                 TEXT            DEFAULT NULL,
              createdAt             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
              createdBy             VARCHAR(100)    DEFAULT NULL,
              KEY idx_brand         (brandID),
              KEY idx_orderItemID   (orderItemID),
              KEY idx_orderID       (orderID),
              KEY idx_month         (settlementMonth),
              KEY idx_brand_month   (brandID, settlementMonth)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Creating brand_settlement_periods table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS brand_settlement_periods (
              id              INT AUTO_INCREMENT PRIMARY KEY,
              brandID         VARCHAR(100)  NOT NULL,
              settlementMonth VARCHAR(7)    NOT NULL,
              periodStart     DATE          NOT NULL,
              periodEnd       DATE          NOT NULL,
              commissionPct   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
              totalCredits    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              totalDebits     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              totalOnHold     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              netPayable      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              amountPaid      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              balanceDue      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              creditCount     INT           NOT NULL DEFAULT 0,
              debitCount     INT           NOT NULL DEFAULT 0,
              holdCount       INT           NOT NULL DEFAULT 0,
              status          ENUM('open','pending_payment','partially_paid','paid','on_hold') NOT NULL DEFAULT 'open',
              notes           TEXT          DEFAULT NULL,
              paidBy          VARCHAR(50)   DEFAULT NULL,
              paidAt          DATETIME      DEFAULT NULL,
              createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY uq_brand_month (brandID, settlementMonth),
              KEY idx_brandID           (brandID),
              KEY idx_status            (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Creating brand_settlement_payments table...');
        await db.execute(`
              CREATE TABLE IF NOT EXISTS brand_settlement_payments (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                settlementPeriodID  INT           NOT NULL,
                brandID             VARCHAR(100)  NOT NULL,
                amount              DECIMAL(12,2) NOT NULL,
                paymentMode         ENUM('bank_transfer','upi','neft','rtgs','cheque','adjustment','other') NOT NULL,
                utrReference        VARCHAR(100)  DEFAULT NULL,
                paymentDate         DATE          NOT NULL,
                bankDetailID        INT           DEFAULT NULL,
                remarks             TEXT          DEFAULT NULL,
                recordedBy          VARCHAR(50)   NOT NULL,
                createdAt           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (settlementPeriodID) REFERENCES brand_settlement_periods(id) ON DELETE RESTRICT,
                KEY idx_brandID            (brandID),
                KEY idx_settlementPeriodID (settlementPeriodID)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Tables created successfully.');
    } catch (error) {
        console.error('Table creation failed:', error);
    } finally {
        process.exit();
    }
}

createTables();
