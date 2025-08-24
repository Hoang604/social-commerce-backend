import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { FacebookParticipant } from '../entities/facebook-participant.entity';
import { InjectRepository } from '@nestjs/typeorm';

interface ParticipantData {
  facebookUserId: string;
  name: string;
  profilePicUrl?: string;
}

@Injectable()
export class ParticipantService {
  constructor(
    @InjectRepository(FacebookParticipant)
    private readonly participantRepository: Repository<FacebookParticipant>
  ) {}

  async upsert(
    participantData: ParticipantData,
    manager: EntityManager
  ): Promise<FacebookParticipant> {
    const repo = manager.getRepository(FacebookParticipant);
    let participant = await repo.findOne({
      where: { facebookUserId: participantData.facebookUserId },
    });

    if (participant) {
      // Cập nhật nếu có thay đổi
      participant.name = participantData.name;
      // SỬA LỖI: Chuyển đổi `undefined` thành `null` để tương thích với CSDL
      participant.profilePicUrl = participantData.profilePicUrl ?? null;
    } else {
      // Tạo mới nếu chưa tồn tại
      participant = repo.create({
        ...participantData,
        profilePicUrl: participantData.profilePicUrl ?? null,
      });
    }

    return repo.save(participant);
  }
}
