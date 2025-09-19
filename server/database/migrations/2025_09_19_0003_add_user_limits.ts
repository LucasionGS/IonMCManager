import { QueryInterface, DataTypes } from 'sequelize';
import { DBMigration } from "../migration.ts";

export default new DBMigration({
  async up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('users', 'serverLimit', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: 'Maximum number of servers this user can create'
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('users', 'serverLimit');
  }
});