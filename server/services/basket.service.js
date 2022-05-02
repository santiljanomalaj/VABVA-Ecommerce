const httpStatus = require('http-status');
const { Basket, Product } = require('../models');
const ApiError = require('../utils/ApiError');

const validateBusketProducts = async (basketLocationName, basketLocation, product) => {
    if (!await Product.isProductExists(product.productId)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    if (!await Product.isQuantityAvailable(product.productId)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Product quantity is run out');
    }

    if (!await Product.isWithinProductLocation(product.productId, basketLocation)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Product is out of user location');
    }

    // validate product quantity is greater than the basket product quantity
    if (!await Product.isQuantityGreater(product.productId, product.quantity)) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Product quantity exceeds stock availablity');
    }

    if (product.service.type == 'hire' || product.service.type == 'timed-service') {

        // In case of hire, total booked quantity
        if (product.service.type == 'hire') {
            let productInStock = await Product.findOne({ _id: product.productId });
            let totalAvailableQuantity = productInStock.stock.quantity;

            for (let date of product.service.dates) {
                let selectedDate = new Date(date);

                let bookedProducts = await Basket.aggregate([
                    { $unwind: "$products" },
                    { $unwind: "$products.service" },
                    { $match: { "products.service.dates": selectedDate } },
                    { $project: { "products": 1 } }
                ]);

                let bookedProductQuantity = 0
                bookedProducts.forEach(basket => bookedProductQuantity += basket.products.quantity);
                if (bookedProductQuantity + product.quantity > totalAvailableQuantity) {
                    throw new ApiError(httpStatus.NOT_FOUND, 'Total booked quantity is exceed the total available amount.');
                }
            }
        }

        // dates selected is allowed based on the Business opening dates in the location

        // if there is selective booking, validate the dates are in sequence
        let dateDiffs = product.service.dates.slice(1).map((elem, i) => (new Date(elem) - new Date(product.service.dates[i])) / (1000 * 3600 * 24));
        if (product.isSelectiveBooking && dateDiffs.some(d => d !== 1)) {
            throw new ApiError(httpStatus.NOT_FOUND, 'In selective booking, dates should be in sqeuence');
        }
    }
}

const createBasket = async (basketBody) => {
    // if (await Basket.isBasketExists(basketBody.userId)) {
    //     throw new ApiError(httpStatus.BAD_REQUEST, 'Basket already exists');
    // }

    for (let product of basketBody.products) {

        try {
            await validateBusketProducts(basketBody.locationName, basketBody.location.coordinates, product);
        } catch (err) {
            throw err;
        }
    }

    const basket = await Basket.create(basketBody);
    return basket;
};

const queryBaskets = async (filter, options) => {
    const basket = await Basket.paginate(filter, options);
    return basket;
}

const getBasketById = async (id) => {
    return Basket.findById(id);
}

const getBaskets = async () => {
    return Basket.find();
}

const updateBasketById = async (basketId, updateBody) => {

    const basket = await getBasketById(basketId);
    if (!basket) { throw new ApiError(httpStatus.NOT_FOUND, 'Basket not found'); }

    for (let product of updateBody.products) {
        if (!await Product.isProductExists(product.productId)) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
        }
        if (!await Product.isQuantityAvailable(product.productId)) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Product quantity is run out');
        }
        if (!await Product.isWithinProductLocation(product.productId, updateBody.location.coordinates)) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Product is out of user location');
        }
    }

    Object.assign(basket, updateBody);
    basket.save();
    return basket;
}

// const deleteBasketById = async (basketId) => {
//     const basket = await getBasketById(basketId);
//     if (!basket) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'Basket not found');
//     }
//     await basket.remove();
//     return basket;
// }

module.exports = {
    createBasket,
    queryBaskets,
    getBasketById,
    getBaskets,
    updateBasketById,
    // deleteBasketById
};
