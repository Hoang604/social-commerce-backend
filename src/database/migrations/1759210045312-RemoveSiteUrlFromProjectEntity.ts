import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSiteUrlFromProjectEntity1759210045312 implements MigrationInterface {
    name = 'RemoveSiteUrlFromProjectEntity1759210045312'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "site_url"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "site_url" character varying`);
    }

}
