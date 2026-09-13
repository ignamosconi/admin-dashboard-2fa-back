import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Index()
  @Column('uuid')
  familyId!: string;

  @Index()
  @Column()
  sub!: string;

  // 'student' | 'admin'
  @Column()
  type!: string;

  @Column({ default: false })
  used!: boolean;

  @Column({ default: false })
  revoked!: boolean;

  @Column()
  expiresAt!: Date;

  // Límite absoluto de la sesión. Se fija al crear el primer refresh token
  // de la familia (al canjear el authorization code) y se hereda en cada
  // rotación sin modificarse. NULL para tokens de admin (sin límite absoluto).
  @Column({ nullable: true, type: 'timestamp' })
  sessionExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}