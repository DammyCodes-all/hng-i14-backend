import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  sayHello() {
    return {
      status: 'success',
      message: 'API is live!',
    };
  }
}
