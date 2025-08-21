import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  ValidationPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user-dto';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@Request() req): Promise<Omit<User, 'passwordHash'>> {
    const userId = req.user.id; // take user ID from the request after authentication
    const user = await this.userService.findOneById(userId);

    // Very important: Remove the passwordHash field before returning to the client
    const { passwordHash, ...result } = user;
    return result;
  }

  @Patch('me')
  async updateProfile(
    @Request() req,
    @Body(new ValidationPipe()) updateUserDto: UpdateUserDto
  ): Promise<Omit<User, 'passwordHash'>> {
    const userId = req.user.id;
    const updatedUser = await this.userService.updateProfile(
      userId,
      updateUserDto
    );

    const { passwordHash, ...result } = updatedUser;
    return result;
  }

  @Delete('me')
  async deactivateAccount(@Request() req): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.userService.deactivate(userId);
    return { message: 'Tài khoản của bạn đã được vô hiệu hóa thành công.' };
  }
}
