import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1783868251728 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "username"  character varying NOT NULL,
        "password"  character varying NOT NULL,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admins_username" UNIQUE ("username"),
        CONSTRAINT "PK_admins" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admins"`);
  }
}