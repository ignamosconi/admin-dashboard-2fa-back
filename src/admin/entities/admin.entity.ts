import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('admins')
export class AdminEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  // Secret TOTP cifrado con AES-256-GCM (mismo mecanismo que credential tokens)
  // null = nunca configuró 2FA
  @Column({ nullable: true, type: 'varchar' })
  totpSecret!: string | null;

  @Column({ default: false })
  totpEnabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}