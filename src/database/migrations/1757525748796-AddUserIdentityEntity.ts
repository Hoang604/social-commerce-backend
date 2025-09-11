import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIdentityEntity1757525748796 implements MigrationInterface {
    name = 'AddUserIdentityEntity1757525748796'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying NOT NULL, "provider_id" character varying NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "UQ_d40af40141fe53f9cee9b7a2fb0" UNIQUE ("provider", "provider_id"), CONSTRAINT "PK_e23bff04e9c3e7b785e442b262c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_identities" ADD CONSTRAINT "FK_bf5fe01eb8cad7114b4c371cdc7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_identities" DROP CONSTRAINT "FK_bf5fe01eb8cad7114b4c371cdc7"`);
        await queryRunner.query(`DROP TABLE "user_identities"`);
    }

}
