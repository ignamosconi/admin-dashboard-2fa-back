import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminTotp1783930000000 implements MigrationInterface {
  name = 'AdminTotp1783930000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admins" ADD "totpSecret" character varying`);
    await queryRunner.query(`ALTER TABLE "admins" ADD "totpEnabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "totpEnabled"`);
    await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "totpSecret"`);
  }
}