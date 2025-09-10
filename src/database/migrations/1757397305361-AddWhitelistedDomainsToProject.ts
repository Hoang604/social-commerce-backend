import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWhitelistedDomainsToProject1757397305361 implements MigrationInterface {
    name = 'AddWhitelistedDomainsToProject1757397305361'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "whitelisted_domains" text array`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "whitelisted_domains"`);
    }

}
