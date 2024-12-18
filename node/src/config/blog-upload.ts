export default {
	image: {
		dir: 'public/image/blog',
		limit: 3072000,
	},
	video: {
		dir: 'public/video/blog',
		limit: 30720000,
	},
	response: {
		success: {
			code: 1,
			message: 'File upload was successful.',
		},
		type: {
			code: 11,
			message: 'The upload was not executed because it is an unsupported MIME type.',
		},
		overwrite: {
			code: 12,
			message: 'The upload was not executed because the file already exists.',
		},
		size: {
			code: 13,
			message: 'The upload was not executed because the file size exceeds the specified size.',
		},
		requestQuery: {
			code: 21,
			message: 'Insufficient request parameters.',
		},
	},
};
