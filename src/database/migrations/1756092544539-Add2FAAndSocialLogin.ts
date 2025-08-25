import { MigrationInterface, QueryRunner } from "typeorm";

export class Add2FAAndSocialLogin1756092544539 implements MigrationInterface {
    name = 'Add2FAAndSocialLogin1756092544539'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "social_accounts" ("id" BIGSERIAL NOT NULL, "user_id" uuid NOT NULL, "provider" character varying(50) NOT NULL, "provider_user_id" character varying NOT NULL, CONSTRAINT "UQ_4508a993f9340ca4e7547db4ff3" UNIQUE ("provider", "provider_user_id"), CONSTRAINT "PK_e9e58d2d8e9fafa20af914d9750" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_05a0f282d3bed93ca048a7e54d" ON "social_accounts" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "two_factor_recovery_codes" ("id" BIGSERIAL NOT NULL, "user_id" uuid NOT NULL, "hashed_code" character varying NOT NULL, "is_used" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_6f535a18c9fb9da8cc9b7ea70dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd306548ffdd22f61714667084" ON "two_factor_recovery_codes" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_two_factor_authentication_enabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "two_factor_authentication_secret" text`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "social_accounts" ADD CONSTRAINT "FK_05a0f282d3bed93ca048a7e54dd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "FK_dd306548ffdd22f617146670845" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "FK_dd306548ffdd22f617146670845"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP CONSTRAINT "FK_05a0f282d3bed93ca048a7e54dd"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "two_factor_authentication_secret"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_two_factor_authentication_enabled"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd306548ffdd22f61714667084"`);
        await queryRunner.query(`DROP TABLE "two_factor_recovery_codes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05a0f282d3bed93ca048a7e54d"`);
        await queryRunner.query(`DROP TABLE "social_accounts"`);
    }

}
