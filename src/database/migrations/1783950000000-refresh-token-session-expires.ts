import { MigrationInterface, QueryRunner } from "typeorm";

export class RefreshTokenSessionExpires1783950000000 implements MigrationInterface {
  name = 'RefreshTokenSessionExpires1783950000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // sessionExpiresAt: límite absoluto de la sesión, se hereda en cada rotación
    // y nunca se extiende. NULL en registros existentes (admins) — solo aplica a alumnos.
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN "sessionExpiresAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN "sessionExpiresAt"
    `);
  }
}