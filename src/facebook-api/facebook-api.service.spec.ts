import { Test, TestingModule } from '@nestjs/testing';
import { FacebookApiService } from './facebook-api.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';

describe('FacebookApiService', () => {
  let service: FacebookApiService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookApiService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('v19.0'),
          },
        },
      ],
    }).compile();

    service = module.get<FacebookApiService>(FacebookApiService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const response: AxiosResponse = { data: { message_id: '123' }, status: 200, statusText: 'OK', headers: {}, config: {} };
      jest.spyOn(httpService, 'post').mockReturnValue(of(response));

      const result = await service.sendMessage('token', 'recipient', 'text');

      expect(result).toEqual({ message_id: '123' });
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle Facebook API error', async () => {
        const error = new AxiosError('Request failed with status code 500');
        error.response = { data: { error: { type: 'OAuthException', message: 'Invalid OAuth access token.' } }, status: 500, statusText: 'Internal Server Error', headers: {}, config: {} };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error));
  
        await expect(service.sendMessage('token', 'recipient', 'text')).rejects.toThrow(InternalServerErrorException);
      });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const profile = { name: 'Test User', profile_pic: 'pic_url' };
      const response: AxiosResponse = { data: profile, status: 200, statusText: 'OK', headers: {}, config: {} };
      jest.spyOn(httpService, 'get').mockReturnValue(of(response));

      const result = await service.getUserProfile('userId', 'token');

      expect(result).toEqual(profile);
      expect(httpService.get).toHaveBeenCalled();
    });

    it('should return default profile on error', async () => {
        const error = new AxiosError('Request failed with status code 404');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));
  
        const result = await service.getUserProfile('userId', 'token');
  
        expect(result).toEqual({ name: 'User userId', profile_pic: null });
      });
  });
});