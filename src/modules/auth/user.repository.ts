import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserData, IUserRepository } from './user-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `users` (§5.2). Satu-satunya
 * tempat yang boleh query langsung ke tabel `users` lewat TypeORM.
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  private getRepository(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.repository;
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByEmailOrPhone(emailOrPhone: string): Promise<User | null> {
    return this.repository.findOne({
      where: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    });
  }

  create(data: CreateUserData, manager?: EntityManager): Promise<User> {
    const repository = this.getRepository(manager);
    const user = repository.create({ ...data, isActive: true });
    return repository.save(user);
  }

  async updateLastLogin(id: string, date: Date): Promise<void> {
    await this.repository.update(id, { lastLoginAt: date });
  }
}
