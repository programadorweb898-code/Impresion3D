// Bounded factors make the 50/30/20 weights comparable.
export function relevancePipeline(filter, page, limit) {
  return [
    { $match: filter },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'items.productId',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              status: { $ne: 'cancelado' },
              $or: [
                { status: { $in: ['en_preparacion', 'finalizado'] } },
                { 'history.status': 'aprobado' },
              ],
            },
          },
          { $unwind: '$items' },
          { $match: { $expr: { $eq: ['$items.productId', '$$productId'] } } },
          { $group: { _id: null, units: { $sum: '$items.quantity' } } },
        ],
        as: '_sales',
      },
    },
    {
      $set: {
        salesCount: {
          $add: [
            { $ifNull: ['$historicalSalesCount', 0] },
            { $ifNull: [{ $arrayElemAt: ['$_sales.units', 0] }, 0] },
          ],
        },
        viewsCount: { $ifNull: ['$viewsCount', 0] },
      },
    },
    {
      $set: {
        relevanceScore: {
          $add: [
            {
              $multiply: [
                0.5,
                { $divide: ['$salesCount', { $add: ['$salesCount', 10] }] },
              ],
            },
            {
              $multiply: [
                0.3,
                { $divide: ['$viewsCount', { $add: ['$viewsCount', 100] }] },
              ],
            },
            {
              $multiply: [
                0.2,
                {
                  $divide: [
                    1,
                    {
                      $add: [
                        1,
                        {
                          $divide: [
                            {
                              $max: [
                                0,
                                {
                                  $subtract: [
                                    '$$NOW',
                                    { $ifNull: ['$createdAt', new Date(0)] },
                                  ],
                                },
                              ],
                            },
                            2592000000,
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $sort: {
        relevanceScore: -1,
        salesCount: -1,
        viewsCount: -1,
        createdAt: -1,
        _id: -1,
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $unset: ['_sales', '__v'] },
  ];
}
