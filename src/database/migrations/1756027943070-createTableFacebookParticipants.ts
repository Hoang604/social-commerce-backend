import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTableFacebookParticipants1756027943070 implements MigrationInterface {
    name = 'CreateTableFacebookParticipants1756027943070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_connected_pages_user_id_facebook_page_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_messages_on_conversation_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_conversations_on_connected_page_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_comments_on_connected_page_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_comments_on_parent_comment_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_comments_on_facebook_post_id"`);
        await queryRunner.query(`CREATE TABLE "facebook_participants" ("id" BIGSERIAL NOT NULL, "facebook_user_id" character varying NOT NULL, "name" character varying NOT NULL, "profile_pic_url" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5d4918c76a474874b19872a1e73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0d9b3cf88c13121d19d1bc27c0" ON "facebook_participants" ("facebook_user_id") `);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "customer_name"`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "participant_id" bigint NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_status_enum" AS ENUM('open', 'closed', 'pending')`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'open'`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "unread_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7c89cc0ba8032b4e3930a437b8" ON "connected_pages" ("user_id", "facebook_page_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7260e45092709691091bbc3924" ON "conversations" ("connected_page_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce5300b283e93c2b186df51cd0" ON "conversations" ("participant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_517acf7e04a7232adb0c760c4b" ON "conversations" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_1291d1e63d8a34ae69e7425553" ON "comments" ("connected_page_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_93ce08bdbea73c0c7ee673ec35" ON "comments" ("parent_comment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_04f8995fe7dbdf34bb9bb7e558" ON "comments" ("facebook_post_id") `);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_ce5300b283e93c2b186df51cd0c" FOREIGN KEY ("participant_id") REFERENCES "facebook_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_ce5300b283e93c2b186df51cd0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_04f8995fe7dbdf34bb9bb7e558"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_93ce08bdbea73c0c7ee673ec35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1291d1e63d8a34ae69e7425553"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_517acf7e04a7232adb0c760c4b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce5300b283e93c2b186df51cd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7260e45092709691091bbc3924"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c89cc0ba8032b4e3930a437b8"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "unread_count"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "participant_id"`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "customer_name" character varying`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d9b3cf88c13121d19d1bc27c0"`);
        await queryRunner.query(`DROP TABLE "facebook_participants"`);
        await queryRunner.query(`CREATE INDEX "idx_comments_on_facebook_post_id" ON "comments" ("facebook_post_id") `);
        await queryRunner.query(`CREATE INDEX "idx_comments_on_parent_comment_id" ON "comments" ("parent_comment_id") `);
        await queryRunner.query(`CREATE INDEX "idx_comments_on_connected_page_id" ON "comments" ("connected_page_id") `);
        await queryRunner.query(`CREATE INDEX "idx_conversations_on_connected_page_id" ON "conversations" ("connected_page_id") `);
        await queryRunner.query(`CREATE INDEX "idx_messages_on_conversation_id" ON "messages" ("conversation_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_connected_pages_user_id_facebook_page_id" ON "connected_pages" ("facebook_page_id", "user_id") `);
    }

}
