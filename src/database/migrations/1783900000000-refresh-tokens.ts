import { MigrationInterface, QueryRunner } from "typeorm";

export class RefreshTokens1783900000000 implements MigrationInterface {
  name = 'RefreshTokens1783900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "tokenHash"  character varying NOT NULL,
        "familyId"   uuid        NOT NULL,
        "sub"        character varying NOT NULL,
        "type"       character varying NOT NULL,
        "used"       boolean     NOT NULL DEFAULT false,
        "revoked"    boolean     NOT NULL DEFAULT false,
        "expiresAt"  TIMESTAMP   NOT NULL,
        "createdAt"  TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_familyId" ON "refresh_tokens" ("familyId")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_sub_type" ON "refresh_tokens" ("sub", "type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_sub_type"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_familyId"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}