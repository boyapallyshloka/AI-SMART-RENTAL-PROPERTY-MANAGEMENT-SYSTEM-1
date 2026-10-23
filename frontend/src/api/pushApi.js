import axiosClient from './axiosClient'

export const registerPushSubscription = async (subscription) => {
  return axiosClient.post('/v1/notifications/register-device', {
    ...subscription,
    deviceType: 'WEB',
  })
}
