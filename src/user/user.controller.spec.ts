import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user-dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findOneById: jest.fn(),
            updateProfile: jest.fn(),
            deactivate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return the user profile without the password hash', async () => {
      const userId = 'some-user-id';
      const user = {
        id: userId,
        email: 'test@example.com',
        passwordHash: 'some-hashed-password',
        fullName: 'Test User',
        // other user properties...
      };
      const req = { user: { id: userId } };

      (userService.findOneById as jest.Mock).mockResolvedValue(user);

      const result = await controller.getProfile(req);

      expect(userService.findOneById).toHaveBeenCalledWith(userId);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toEqual(user.email);
    });
  });

  describe('updateProfile', () => {
    it('should update the user profile and return the updated user without the password hash', async () => {
      const userId = 'some-user-id';
      const updateUserDto: UpdateUserDto = { fullName: 'Updated Name' };
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        passwordHash: 'some-hashed-password',
        fullName: 'Updated Name',
      };
      const req = { user: { id: userId } };

      (userService.updateProfile as jest.Mock).mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(req, updateUserDto);

      expect(userService.updateProfile).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.fullName).toEqual(updateUserDto.fullName);
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate the user account and return a success message', async () => {
      const userId = 'some-user-id';
      const req = { user: { id: userId } };

      (userService.deactivate as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.deactivateAccount(req);

      expect(userService.deactivate).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ message: 'Tài khoản của bạn đã được vô hiệu hóa thành công.' });
    });
  });
});
