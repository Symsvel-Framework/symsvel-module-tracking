<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127120001 extends AbstractMigration
{
    public function up(Schema $schema): void
    {
        $table = $schema->createTable('symsvel_tracking_catalog');
        $table->addColumn('id', 'string', ['length' => 100]);
        $table->addColumn('provider', 'string', ['length' => 100]);
        $table->addColumn('provider_identifier', 'string', ['length' => 255]);
        $table->addColumn('name', 'string', ['length' => 150]);
        $table->addColumn('purpose', 'string', ['length' => 150]);
        $table->addColumn('description', 'text');
        $table->addColumn('privacy_url', 'string', ['length' => 2048]);
        $table->addColumn('scope_app', 'boolean', ['default' => false]);
        $table->addColumn('scope_front', 'boolean', ['default' => false]);
        $table->addColumn('active', 'boolean', ['default' => false]);
        $table->addColumn('revision', 'integer', ['default' => 1]);
        $table->setPrimaryKey(['id']);
    }

    public function down(Schema $schema): void
    {
        $schema->dropTable('symsvel_tracking_catalog');
    }
}
