import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUserIdFromProjectEntity1759164676747 implements MigrationInterface {
    name = 'RemoveUserIdFromProjectEntity1759164676747'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "user_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "user_id" uuid NOT NULL`);
    }

}
