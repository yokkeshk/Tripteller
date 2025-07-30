import axios from 'axios';

export const fetchCalls = async (userId: string) => {
  const res = await axios.get(`/api/calls/${userId}`);
  return res.data;
};

export const assignCall = async (data: {
  userId: string;
  address: string;
  lat: number;
  lng: number;
  notes?: string;
}) => {
  const res = await axios.post('/api/calls', data);
  return res.data;
};

export const startCall = async (callId: string) => {
  const res = await axios.post(`/api/calls/${callId}/start`);
  return res.data;
};

export const completeCall = async (callId: string) => {
  const res = await axios.post(`/api/calls/${callId}/complete`);
  return res.data;
};
