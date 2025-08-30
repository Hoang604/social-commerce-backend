import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FacebookParticipant } from '../entities/facebook-participant.entity';

interface ParticipantData {
  facebookUserId: string;
  name: string;
  profilePicUrl?: string;
}

@Injectable()
export class ParticipantService {
  constructor() {}

  async upsert(
    participantData: ParticipantData,
    manager: EntityManager,
  ): Promise<FacebookParticipant> {
    let participant = await manager.findOne(FacebookParticipant, {
      where: { facebookUserId: participantData.facebookUserId },
    });

    if (participant) {
      // Cập nhật nếu có thay đổi
      participant.name = participantData.name;
      // SỬA LỖI: Chuyển đổi `undefined` thành `null` để tương thích với CSDL
      participant.profilePicUrl = participantData.profilePicUrl ?? null;
    } else {
      // Tạo mới nếu chưa tồn tại
      participant = manager.create(FacebookParticipant, {
        ...participantData,
        profilePicUrl: participantData.profilePicUrl ?? null,
      });
    }

    return manager.save(participant);
  }
}
