import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorForLiveChat1757319269800 implements MigrationInterface {
    name = 'RefactorForLiveChat1757319269800'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hashed_token" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ip_address" character varying, "user_agent" text, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "two_factor_recovery_codes" ("id" BIGSERIAL NOT NULL, "user_id" uuid NOT NULL, "hashed_code" character varying NOT NULL, "is_used" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_6f535a18c9fb9da8cc9b7ea70dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd306548ffdd22f61714667084" ON "two_factor_recovery_codes" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."messages_status_enum" AS ENUM('sending', 'sent', 'delivered', 'read', 'failed')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" BIGSERIAL NOT NULL, "conversation_id" bigint NOT NULL, "content" text, "attachments" jsonb, "sender_id" character varying NOT NULL, "recipient_id" character varying NOT NULL, "from_customer" boolean NOT NULL, "status" "public"."messages_status_enum" NOT NULL DEFAULT 'sent', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_befd307485dbf0559d17e4a4d2" ON "messages" ("status") `);
        await queryRunner.query(`CREATE TABLE "visitors" ("id" SERIAL NOT NULL, "project_id" integer NOT NULL, "visitor_uid" uuid NOT NULL, "display_name" character varying, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_2f341f32aa2c5ffd37c4eb21fa5" UNIQUE ("visitor_uid"), CONSTRAINT "PK_d0fd6e34a516c2bb3bbec71abde" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_visitor_uid" ON "visitors" ("visitor_uid") `);
        await queryRunner.query(`CREATE TYPE "public"."conversations_status_enum" AS ENUM('open', 'closed', 'pending')`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" BIGSERIAL NOT NULL, "last_message_snippet" text, "last_message_timestamp" TIMESTAMP WITH TIME ZONE, "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'open', "unread_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" integer, "visitor_id" integer, CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_517acf7e04a7232adb0c760c4b" ON "conversations" ("status") `);
        await queryRunner.query(`CREATE TABLE "projects" ("id" SERIAL NOT NULL, "user_id" uuid NOT NULL, "name" character varying NOT NULL, "site_url" character varying, "widget_settings" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying, "full_name" character varying, "avatar_url" character varying, "timezone" character varying NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', "language" character varying(2) NOT NULL DEFAULT 'vi', "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "last_login_at" TIMESTAMP WITH TIME ZONE, "tokens_valid_from" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_two_factor_authentication_enabled" boolean NOT NULL DEFAULT false, "two_factor_authentication_secret" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "FK_dd306548ffdd22f617146670845" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visitors" ADD CONSTRAINT "FK_7fde2a51625e05754083d2b98f1" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_9f16876c6b675f1f683e604b511" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_5e69b83b44d285e714d9349a8fe" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_bd55b203eb9f92b0c8390380010" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_bd55b203eb9f92b0c8390380010"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_5e69b83b44d285e714d9349a8fe"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_9f16876c6b675f1f683e604b511"`);
        await queryRunner.query(`ALTER TABLE "visitors" DROP CONSTRAINT "FK_7fde2a51625e05754083d2b98f1"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "FK_dd306548ffdd22f617146670845"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_517acf7e04a7232adb0c760c4b"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_visitor_uid"`);
        await queryRunner.query(`DROP TABLE "visitors"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_befd307485dbf0559d17e4a4d2"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd306548ffdd22f61714667084"`);
        await queryRunner.query(`DROP TABLE "two_factor_recovery_codes"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    }

}
