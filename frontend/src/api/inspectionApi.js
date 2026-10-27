import axiosClient from './axiosClient.js'

export const getManagerInspections = async () => axiosClient.get('/inspections/manager')

export const createManagerInspection = async (payload) => axiosClient.post('/inspections', payload)
