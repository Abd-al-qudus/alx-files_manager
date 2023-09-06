import api from '../server';
import supertest from 'supertest';
import chai from 'chai';

global.app = api;
global.request = supertest(api);
global.expect = chai.expect;
global.assert = chai.assert;