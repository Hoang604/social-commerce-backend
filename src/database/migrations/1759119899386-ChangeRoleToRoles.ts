import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeRoleToRoles1759119899386 implements MigrationInterface {
    name = 'ChangeRoleToRoles1759119899386'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "role" TO "roles"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "roles" TO "role"`);
    }

}
