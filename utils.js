module.exports = (req, res, db) => {
    return {
        send(msg, code = 200) {
            res.set('Access-Control-Allow-Origin', req.get('origin'));
            res.set('Access-Control-Allow-Credentials', 'true');
            res.set('Access-Control-Allow-Headers', '*');
            res.status(code).json({
                success: code == 200,
                code,
                msg
            });
        },
        db,
        data: req.body,
        session: req.session
    };
};