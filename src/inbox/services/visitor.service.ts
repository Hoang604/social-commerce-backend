// src/inbox/services/visitor.service.ts

import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Visitor } from '../entities/visitor.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class VisitorService {
  constructor(
    @InjectRepository(Visitor)
    private readonly visitorRepository: Repository<Visitor>
  ) {}

  /**
   * Finds an existing visitor by their unique UID or creates a new one if not found.
   * This operation is designed to be used within a transaction.
   * @param projectId The ID of the project the visitor belongs to.
   * @param visitorUid The unique identifier for the visitor (from client-side).
   * @param manager The EntityManager from an active transaction.
   * @returns The found or newly created Visitor entity.
   */
  async findOrCreateByUid(
    projectId: number,
    visitorUid: string,
    manager: EntityManager
  ): Promise<Visitor> {
    const visitorRepo = manager.getRepository(Visitor);

    let visitor = await visitorRepo.findOne({
      where: { visitorUid },
    });

    if (!visitor) {
      // Generate a user-friendly display name for new visitors
      const displayName = `Visitor #${visitorUid.substring(0, 6)}`;

      visitor = visitorRepo.create({
        projectId,
        visitorUid,
        displayName,
        lastSeenAt: new Date(),
      });
      await visitorRepo.save(visitor);
    } else {
      // Update last seen timestamp for returning visitors
      visitor.lastSeenAt = new Date();
      await visitorRepo.save(visitor);
    }

    return visitor;
  }
}
