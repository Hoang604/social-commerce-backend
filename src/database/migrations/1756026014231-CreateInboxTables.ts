import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateInboxTables1724492100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversations table
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'connected_page_id', type: 'uuid', isNullable: false },
          {
            name: 'facebook_conversation_id',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          { name: 'customer_name', type: 'varchar', isNullable: true },
          { name: 'last_message_snippet', type: 'text', isNullable: true },
          {
            name: 'last_message_timestamp',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'conversation_id', type: 'bigint', isNullable: false },
          {
            name: 'facebook_message_id',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          { name: 'content', type: 'text', isNullable: true },
          { name: 'attachments', type: 'jsonb', isNullable: true },
          { name: 'sender_id', type: 'varchar', isNullable: false },
          { name: 'recipient_id', type: 'varchar', isNullable: false },
          { name: 'from_customer', type: 'boolean', isNullable: false },
          {
            name: 'created_at_facebook',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create comments table
    await queryRunner.createTable(
      new Table({
        name: 'comments',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'connected_page_id', type: 'uuid', isNullable: false },
          { name: 'parent_comment_id', type: 'bigint', isNullable: true },
          {
            name: 'facebook_comment_id',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          { name: 'facebook_post_id', type: 'varchar', isNullable: false },
          { name: 'content', type: 'text', isNullable: true },
          { name: 'attachments', type: 'jsonb', isNullable: true },
          { name: 'sender_id', type: 'varchar', isNullable: false },
          { name: 'from_customer', type: 'boolean', isNullable: false },
          {
            name: 'created_at_facebook',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'conversations',
      new TableForeignKey({
        columnNames: ['connected_page_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'connected_pages',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['conversation_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'conversations',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'comments',
      new TableForeignKey({
        columnNames: ['connected_page_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'connected_pages',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'comments',
      new TableForeignKey({
        columnNames: ['parent_comment_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'comments',
        onDelete: 'SET NULL',
      })
    );

    // Add indexes
    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'idx_conversations_on_connected_page_id',
        columnNames: ['connected_page_id'],
      })
    );
    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_on_conversation_id',
        columnNames: ['conversation_id'],
      })
    );
    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'idx_comments_on_connected_page_id',
        columnNames: ['connected_page_id'],
      })
    );
    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'idx_comments_on_parent_comment_id',
        columnNames: ['parent_comment_id'],
      })
    );
    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'idx_comments_on_facebook_post_id',
        columnNames: ['facebook_post_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('comments');
    await queryRunner.dropTable('messages');
    await queryRunner.dropTable('conversations');
  }
}
