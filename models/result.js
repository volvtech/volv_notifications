module.exports = class Result {
    value;
    success;
    message;
    code;


    constructor(data) {
        console.log("data**##**", data)
        let { value, message, code } = data;
        this.value = value;
        this.code = code;
        this.message = message;
        //do not trat a 0 value as a failed result
        if (value || value==0) {
            this.success = true;
        } else {
            this.success = false
        }
    }

    static MessageCode = {
        ERROR: 'error',
        SUCCESS: 'success',
        FAILURE: 'failure',
        NO_USER: 'no_user',
        USER_EXISTS: 'user_exists',
        DEVICE_ID_EXISTS: 'device_id_exists',
        USER_NAME_EXISTS:'username_exists',
        NO_DATA: 'no_data',
        INVALID_PARAM: 'invalid_param',
        DUPLICATE_REFERRAL: 'duplicate_referral',
        OWN_REFERRAL: 'own_referral',
        MULTIPLE_REFERRAL: 'multiple_referral',
        INVALID_REFERRAL_CODE: 'invalid_referral_code',
        ERROR_GETTING_URL:'error_getting_url',
        UN_AUTHORIZED: 'un_authorized'
    }
}