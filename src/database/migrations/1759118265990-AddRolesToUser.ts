import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolesToUser1759118265990 implements MigrationInterface {
    name = 'AddRolesToUser1759118265990'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "role" text NOT NULL DEFAULT 'manager'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    }

}
