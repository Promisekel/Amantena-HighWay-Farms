// Cloudinary integration removed. This stub keeps legacy imports working while signaling unavailability.

const stubMessage = 'Cloudinary integration has been removed from this project.';

export const uploadImage = async () => {
  throw new Error(stubMessage);
};

export const deleteImage = async () => {
  throw new Error(stubMessage);
};

const cloudinaryStub = {
  uploadImage,
  deleteImage,
};

export default cloudinaryStub;

