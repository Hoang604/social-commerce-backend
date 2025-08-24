import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateInitialTables1724492000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bảng users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'password_hash', type: 'varchar' },
          { name: 'full_name', type: 'varchar', isNullable: true },
          { name: 'avatar_url', type: 'varchar', isNullable: true },
          { name: 'timezone', type: 'varchar', default: "'Asia/Ho_Chi_Minh'" },
          { name: 'language', type: 'varchar', length: '2', default: "'vi'" },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'suspended'],
            default: "'active'",
          },
          { name: 'last_login_at', type: 'timestamptz', isNullable: true },
          { name: 'tokens_valid_from', type: 'timestamptz', default: 'now()' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true
    );

    // Bảng refresh_tokens
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'hashed_token', type: 'varchar' },
          { name: 'expires_at', type: 'timestamptz' },
          { name: 'user_id', type: 'uuid' }, // <-- SỬA LỖI Ở ĐÂY
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'ip_address', type: 'varchar', isNullable: true },
          { name: 'user_agent', type: 'text', isNullable: true },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Bảng connected_pages
    await queryRunner.createTable(
      new Table({
        name: 'connected_pages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'user_id', type: 'uuid' }, // <-- SỬA LỖI Ở ĐÂY
          { name: 'facebook_page_id', type: 'varchar', isUnique: true },
          { name: 'page_name', type: 'varchar' },
          { name: 'encrypted_page_access_token', type: 'text' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'connected_pages',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createIndex(
      'connected_pages',
      new TableIndex({
        name: 'IDX_connected_pages_user_id_facebook_page_id',
        columnNames: ['user_id', 'facebook_page_id'],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('connected_pages');
    await queryRunner.dropTable('refresh_tokens');
    await queryRunner.dropTable('users');
  }
}
